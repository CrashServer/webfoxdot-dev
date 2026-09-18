// Where each step of a line lives, in characters — what the live gutter boxes.
// This lived inside index.html's inline script and could not be tested at all.
import { parseArrays, arraySpans, altSpans, elementSpans, arpIndex, parseArpMode, _numArray } from '../../js/editor/spans.js';

const text = (line, span) => line.slice(span[0], span[1]);

export default function ({ test, eq, ok }) {
    test('spans: a synth line boxes each degree', () => {
        const L = 'p1 >> pluck([0,2,4], dur=1/2)';
        const groups = parseArrays(L);
        ok(groups && groups.length, 'no groups found');
        eq(groups[0].map(s => text(L, s)), ['0', '2', '4']);
    });

    test('spans: a play line boxes each step of the pattern', () => {
        const L = 'b1 >> play("x-o-")';
        const g = parseArrays(L);
        eq(g[0].map(s => text(L, s)), ['x', '-', 'o', '-']);
    });

    test('spans: an UNQUOTED play pattern counts too', () => {
        // The documented house style, and what every bundled example uses — requiring
        // quotes meant drum lines never lit up while synth lines did.
        const L = 'b1 >> play(x.x.)';
        const g = parseArrays(L);
        eq(g[0].map(s => text(L, s)), ['x', '.', 'x', '.']);
    });

    test('spans: a bracket group is ONE step, spanning the whole group', () => {
        const L = 'b1 >> play("x(oo)-")';
        const g = parseArrays(L);
        eq(g[0].map(s => text(L, s)), ['x', '(oo)', '-']);
    });

    test('spans: a comma inside a play string is not a separator', () => {
        // The old inline copy split here, because it skipped no strings.
        const L = 'b1 >> play("x,o", sample=1)';
        const g = parseArrays(L);
        eq(g[0].map(s => text(L, s)), ['x', ',', 'o']);
    });

    test('spans: params are boxed as well as the pattern', () => {
        const L = 'b1 >> play("x-", crush=[0.3,0.6])';
        const g = parseArrays(L);
        ok(g.length >= 2, `expected the pattern AND the params, got ${g.length} group(s)`);
        eq(g[g.length - 1].map(s => text(L, s)), ['0.3', '0.6']);
    });

    test('spans: an alternation is boxed element by element', () => {
        const L = 'p1 >> pluck(<0 4 7>)';
        const r = altSpans(L, L.indexOf('<'));
        eq(r.spans.map(s => text(L, s)), ['0', '4', '7']);
    });

    test('spans: arp order follows the mode', () => {
        eq(parseArpMode('"updown"'), 'updown');
        eq(parseArpMode('2'), 'updown');          // integer index into the mode list
        eq(parseArpMode('somethingElse'), 'up');  // a var/expr → a sensible default
        // arpIndex(len, step, mode, oct) → which SOURCE element sounds at that step
        eq(arpIndex(3, 0, 'up'), 0);
        eq(arpIndex(3, 2, 'up'), 2);
        eq(arpIndex(3, 3, 'up'), 0);          // wraps
        eq(arpIndex(3, 0, 'down'), 2);        // down starts at the top
        eq(arpIndex(3, 0, 'random'), -1);     // random has no fixed source position
    });

    test('spans: _numArray reads a literal list and refuses anything else', () => {
        eq(_numArray('[1, 2, 3]'), [1, 2, 3]);
        eq(_numArray('[1, x, 3]'), null);
    });

    test('spans: a line with no call yields nothing rather than throwing', () => {
        eq(parseArrays('# just a comment'), null);
        eq(parseArrays('Clock.bpm = 120'), null);
    });
}
